#!/usr/bin/env python3
"""
XML QueryMap to JSON Converter
XML 형식의 queryMap 파일을 JSON 형식으로 변환하는 프로그램
"""

import xml.etree.ElementTree as ET
import json
import sys
import os
import re
import glob
from typing import Dict, Any, List

def clean_multiline_text(text: str) -> str:
    """
    멀티라인 텍스트를 정리하여 JSON에 적합한 형태로 변환
    """
    if not text:
        return ""

    # 앞뒤 공백 및 개행문자 제거
    text = text.strip()

    # 여러 개의 공백이나 탭을 단일 공백으로 변환
    text = re.sub(r'\s+', ' ', text)

    # CDATA 섹션 정리
    text = re.sub(r'<!\[CDATA\[\s*', '', text)
    text = re.sub(r'\s*\]\]>', '', text)

    return text.strip()

def extract_query_id(query_id: str) -> str:
    """
    query id에서 모듈 코드 추출 (예: B47SA508_1.select -> B47)
    """
    # query id에서 첫 3자리 추출 (B47)
    if len(query_id) >= 3:
        return query_id[:3].lower()
    return "unknown"

def parse_glue_sql_file(file_path: str) -> Dict[str, Any]:
    """
    .glue_sql 파일을 파싱하여 JSON 형식으로 변환
    """
    try:
        # XML 파일 파싱
        tree = ET.parse(file_path)
        root = tree.getroot()

        # 파일 이름 추출
        file_name = os.path.basename(file_path)

        # queryMap 정보 추출
        query_map_desc = root.get('desc', '')

        # 모듈 코드 추출 (파일 이름에서)
        module_code = file_name[:3].lower() if len(file_name) >= 3 else "unknown"

        result = {
            module_code: {}
        }

        # query 요소 파싱
        for query in root.findall('query'):
            query_id = query.get('id', '')
            query_desc = query.get('desc', '')
            fetch_size = query.get('fetchSize', '')
            is_named = query.get('isNamed', '')

            # CDATA 내용 추출
            cdata_content = ""
            for child in query:
                if 'CDATA' in child.tag or (child.text and 'CDATA' in child.text):
                    cdata_content = child.text or ""
                    # CDATA 블록에서 실제 내용 추출
                    cdata_match = re.search(r'<!\[CDATA\[(.*?)\]\]>', cdata_content, re.DOTALL)
                    if cdata_match:
                        cdata_content = cdata_match.group(1)
                    break

            # CDATA가 없는 경우 직접 텍스트 추출
            if not cdata_content and query.text:
                cdata_content = query.text

            # 쿼리 텍스트 정리 - 멀티라인 유지
            # 원본 멀티라인 형식을 유지하면서 앞뒤 공백만 정리
            cleaned_query = cdata_content.strip()

            # 쿼리 정보 구성
            query_info = {
                "id": query_id,
                "desc": query_desc,
                "file_name": file_name,
                "query_map_desc": query_map_desc,
                "query": f"<![CDATA[\n{cleaned_query}\n         ]]>"
            }

            # 추가 속성 (fetch_size, is_named는 기본 요구사항에는 없으므로 제외)
            # 요청하신 기본 형식에 맞추기 위해 필수 필드만 포함

            # 결과에 추가
            result[module_code][query_id] = query_info

        return result

    except ET.ParseError as e:
        print(f"XML 파싱 오류: {e}")
        return {"error": f"XML 파싱 오류: {e}"}
    except Exception as e:
        print(f"처리 오류: {e}")
        return {"error": f"처리 오류: {e}"}

def convert_xml_to_json(input_file: str, output_file: str = None) -> bool:
    """
    XML 파일을 JSON 파일로 변환
    """
    try:
        # 입력 파일 존재 확인
        if not os.path.exists(input_file):
            print(f"오류: 입력 파일 '{input_file}'을 찾을 수 없습니다.")
            return False

        # XML 파싱 및 JSON 변환
        result = parse_glue_sql_file(input_file)

        # 출력 파일 이름 결정
        if not output_file:
            base_name = os.path.splitext(input_file)[0]
            output_file = f"{base_name}.json"

        # JSON 파일로 저장
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)

        print(f"변환 완료: {input_file} → {output_file}")
        return True

    except Exception as e:
        print(f"변환 오류: {e}")
        return False

def main():
    """
    메인 함수 - 커맨드 라인 인자 처리
    """
    if len(sys.argv) < 2:
        print("사용법: python xml_to_json_converter.py <입력파일|디렉토리> [출력파일]")
        print("예시 (파일): python xml_to_json_converter.py B47SA508.glue_sql B47SA508.json")
        print("예시 (디렉토리): python xml_to_json_converter.py ./data")
        sys.exit(1)

    input_path = sys.argv[1]

    # 입력 경로가 디렉토리인지 파일인지 확인
    if os.path.isdir(input_path):
        # 디렉토리인 경우: *.glue_sql, *.xml 파일을 모두 처리
        pattern_glue_sql = os.path.join(input_path, "*.glue_sql")
        pattern_xml = os.path.join(input_path, "*.xml")

        files = glob.glob(pattern_glue_sql) + glob.glob(pattern_xml)

        if not files:
            print(f"오류: 디렉토리 '{input_path}'에서 *.glue_sql 또는 *.xml 파일을 찾을 수 없습니다.")
            sys.exit(1)

        print(f"발견된 파일 {len(files)}개를 처리합니다...")
        success_count = 0
        fail_count = 0

        for file in files:
            print(f"\n처리 중: {file}")
            if convert_xml_to_json(file):
                success_count += 1
            else:
                fail_count += 1

        print(f"\n=== 처리 완료 ===")
        print(f"성공: {success_count}개, 실패: {fail_count}개")

        if fail_count > 0:
            sys.exit(1)

    elif os.path.isfile(input_path):
        # 파일인 경우: 단일 파일 처리
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        success = convert_xml_to_json(input_path, output_file)

        if not success:
            sys.exit(1)

    else:
        print(f"오류: '{input_path}'는 유효한 파일 또는 디렉토리가 아닙니다.")
        sys.exit(1)

if __name__ == "__main__":
    main()